import { Injectable } from "@nestjs/common";
import { ProductStatus } from "../prisma/prisma-client";
import { PrismaService } from "../prisma/prisma.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const categoryTreeSelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  isActive: true,
  isVisible: true,
  isFeatured: true,
  sortOrder: true,
  icon: true,
  imageUrl: true,
  description: true
} as const;

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
};

export type PublicCategoryTreeNode = CategoryRecord & {
  depth: number;
  directProductCount: number;
  productCount: number;
  children: PublicCategoryTreeNode[];
};

export type CategoryScope = {
  selectedCategory: CategoryRecord;
  categoryIds: string[];
  breadcrumbs: Array<Pick<CategoryRecord, "id" | "name" | "slug">>;
};

function compareCategories(left: CategoryRecord, right: CategoryRecord) {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
}

@Injectable()
export class CategoryTreeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The authoritative public tree. Only categories reachable through an
   * entirely active and visible ancestor chain are returned. Product totals
   * include the selected category and every public descendant.
   */
  async getPublicTree(): Promise<PublicCategoryTreeNode[]> {
    const [categories, directCounts] = await Promise.all([
      this.loadCategories(true),
      this.prisma.product.groupBy({
        by: ["categoryId"],
        where: { status: ProductStatus.ACTIVE },
        _count: { _all: true }
      })
    ]);

    const counts = new Map(
      directCounts.map((row) => [row.categoryId, row._count._all])
    );
    return this.buildPublicTree(categories, counts);
  }

  async findPublicCategoryBySlug(slug: string) {
    const roots = await this.getPublicTree();

    const visit = (
      nodes: PublicCategoryTreeNode[],
      ancestors: PublicCategoryTreeNode[]
    ): { node: PublicCategoryTreeNode; ancestors: PublicCategoryTreeNode[] } | null => {
      for (const node of nodes) {
        if (node.slug === slug) return { node, ancestors };
        const found = visit(node.children, [...ancestors, node]);
        if (found) return found;
      }
      return null;
    };

    const found = visit(roots, []);
    if (!found) return null;

    return {
      ...found.node,
      breadcrumbs: found.ancestors.map(({ id, name, slug: ancestorSlug }) => ({
        id,
        name,
        slug: ancestorSlug
      }))
    };
  }

  async resolveScope(
    categoryFilter: string,
    options: { publicOnly?: boolean } = {}
  ): Promise<CategoryScope | null> {
    const publicOnly = options.publicOnly !== false;
    const categories = await this.loadCategories(publicOnly);
    const byId = new Map(categories.map((category) => [category.id, category]));
    const selected = categories.find((category) =>
      UUID_PATTERN.test(categoryFilter)
        ? category.id === categoryFilter || category.slug === categoryFilter
        : category.slug === categoryFilter
    );

    if (!selected) return null;

    const breadcrumbs: CategoryRecord[] = [];
    const ancestorIds = new Set<string>([selected.id]);
    let current = selected;
    while (current.parentId) {
      const parent = byId.get(current.parentId);
      // A public child whose parent is hidden/inactive is intentionally not
      // promoted into navigation or exposed through a direct public URL.
      if (!parent || ancestorIds.has(parent.id)) return null;
      breadcrumbs.unshift(parent);
      ancestorIds.add(parent.id);
      current = parent;
    }

    const childrenByParent = this.indexChildren(categories);
    const categoryIds: string[] = [];
    const pending = [selected.id];
    const visited = new Set<string>();
    while (pending.length) {
      const id = pending.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      categoryIds.push(id);
      for (const child of childrenByParent.get(id) ?? []) pending.push(child.id);
    }

    return {
      selectedCategory: selected,
      categoryIds,
      breadcrumbs: breadcrumbs.map(({ id, name, slug }) => ({ id, name, slug }))
    };
  }

  async getDescendantIds(categoryId: string): Promise<string[]> {
    const categories = await this.loadCategories(false);
    const childrenByParent = this.indexChildren(categories);
    const descendants: string[] = [];
    const pending = [...(childrenByParent.get(categoryId) ?? [])].map((item) => item.id);
    const visited = new Set<string>([categoryId]);

    while (pending.length) {
      const id = pending.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      descendants.push(id);
      for (const child of childrenByParent.get(id) ?? []) pending.push(child.id);
    }

    return descendants;
  }

  flattenPublicTree(roots: PublicCategoryTreeNode[]) {
    const result: PublicCategoryTreeNode[] = [];
    const visit = (nodes: PublicCategoryTreeNode[]) => {
      for (const node of nodes) {
        result.push(node);
        visit(node.children);
      }
    };
    visit(roots);
    return result;
  }

  async getPublicCounts(): Promise<Array<{ categoryId: string; count: number }>> {
    const tree = await this.getPublicTree();
    return this.flattenPublicTree(tree).map((category) => ({
      categoryId: category.id,
      count: category.productCount
    }));
  }

  private loadCategories(publicOnly: boolean): Promise<CategoryRecord[]> {
    return this.prisma.category.findMany({
      where: publicOnly ? { isActive: true, isVisible: true } : undefined,
      select: categoryTreeSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  private buildPublicTree(
    categories: CategoryRecord[],
    directCounts: Map<string, number>
  ): PublicCategoryTreeNode[] {
    const byId = new Map<string, PublicCategoryTreeNode>();
    for (const category of categories) {
      byId.set(category.id, {
        ...category,
        depth: 0,
        directProductCount: directCounts.get(category.id) ?? 0,
        productCount: 0,
        children: []
      });
    }

    const roots: PublicCategoryTreeNode[] = [];
    for (const category of categories) {
      const node = byId.get(category.id)!;
      if (!category.parentId) {
        roots.push(node);
      } else {
        const parent = byId.get(category.parentId);
        if (parent) parent.children.push(node);
      }
    }

    const aggregate = (
      node: PublicCategoryTreeNode,
      depth: number,
      path: Set<string>
    ): number => {
      if (path.has(node.id)) return 0;
      const nextPath = new Set(path).add(node.id);
      node.depth = depth;
      node.children.sort(compareCategories);
      node.productCount =
        node.directProductCount +
        node.children.reduce((total, child) => total + aggregate(child, depth + 1, nextPath), 0);
      return node.productCount;
    };

    roots.sort(compareCategories);
    for (const root of roots) aggregate(root, 0, new Set());
    return roots;
  }

  private indexChildren(categories: CategoryRecord[]) {
    const childrenByParent = new Map<string, CategoryRecord[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const children = childrenByParent.get(category.parentId) ?? [];
      children.push(category);
      childrenByParent.set(category.parentId, children);
    }
    return childrenByParent;
  }
}
