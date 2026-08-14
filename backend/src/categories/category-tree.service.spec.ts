import { CategoryTreeService } from "./category-tree.service";

const category = (
  id: string,
  slug: string,
  parentId: string | null,
  overrides: Partial<Record<string, unknown>> = {}
) => ({
  id,
  name: slug,
  slug,
  parentId,
  isActive: true,
  isVisible: true,
  isFeatured: false,
  sortOrder: 0,
  icon: null,
  imageUrl: null,
  description: null,
  ...overrides
});

function setup() {
  const categories = [
    category("root", "computers", null),
    category("child", "components", "root"),
    category("grandchild", "ssd", "child"),
    category("hidden", "hidden", "root", { isVisible: false }),
    category("hidden-child", "hidden-child", "hidden"),
    category("inactive", "inactive", null, { isActive: false })
  ];
  const prisma = {
    category: {
      findMany: jest.fn().mockImplementation(({ where }: { where?: unknown }) =>
        Promise.resolve(
          where
            ? categories.filter((item) => item.isActive && item.isVisible)
            : categories
        )
      )
    },
    product: {
      groupBy: jest.fn().mockResolvedValue([
        { categoryId: "root", _count: { _all: 1 } },
        { categoryId: "child", _count: { _all: 2 } },
        { categoryId: "grandchild", _count: { _all: 3 } },
        { categoryId: "hidden", _count: { _all: 5 } }
      ])
    }
  };
  return { service: new CategoryTreeService(prisma as never), prisma };
}

describe("CategoryTreeService", () => {
  it("builds one recursive public tree and excludes inactive/hidden branches", async () => {
    const { service, prisma } = setup();
    const tree = await service.getPublicTree();

    expect(tree).toHaveLength(1);
    expect(tree[0].slug).toBe("computers");
    expect(tree[0].children[0].children[0].slug).toBe("ssd");
    expect(JSON.stringify(tree)).not.toContain("hidden-child");
    expect(JSON.stringify(tree)).not.toContain("inactive");
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.groupBy).toHaveBeenCalledTimes(1);
  });

  it("aggregates direct and descendant ACTIVE product counts", async () => {
    const { service } = setup();
    const [root] = await service.getPublicTree();

    expect(root.directProductCount).toBe(1);
    expect(root.productCount).toBe(6);
    expect(root.children[0].productCount).toBe(5);
    expect(root.children[0].children[0].productCount).toBe(3);
  });

  it("resolves a parent to itself and every nested descendant without duplicates", async () => {
    const { service } = setup();
    const scope = await service.resolveScope("computers");

    expect(scope?.categoryIds).toEqual(["root", "child", "grandchild"]);
    expect(new Set(scope?.categoryIds).size).toBe(scope?.categoryIds.length);
  });

  it("resolves nested breadcrumbs from real ancestry", async () => {
    const { service } = setup();
    const categoryDetail = await service.findPublicCategoryBySlug("ssd");

    expect(categoryDetail?.breadcrumbs.map((item) => item.slug)).toEqual([
      "computers",
      "components"
    ]);
    expect(categoryDetail?.depth).toBe(2);
  });

  it("does not expose a visible child below a hidden parent", async () => {
    const { service } = setup();
    await expect(service.resolveScope("hidden-child")).resolves.toBeNull();
  });

  it("allows admin scope traversal without applying public visibility", async () => {
    const { service } = setup();
    const scope = await service.resolveScope("hidden", { publicOnly: false });
    expect(scope?.categoryIds).toEqual(["hidden", "hidden-child"]);
  });

  it("returns recursive counts through the compatibility count contract", async () => {
    const { service } = setup();
    const counts = await service.getPublicCounts();
    expect(counts).toEqual(expect.arrayContaining([
      { categoryId: "root", count: 6 },
      { categoryId: "child", count: 5 },
      { categoryId: "grandchild", count: 3 }
    ]));
  });

  it("returns every descendant ID for hierarchy-integrity checks", async () => {
    const { service } = setup();
    await expect(service.getDescendantIds("root")).resolves.toEqual([
      "child",
      "hidden",
      "grandchild",
      "hidden-child"
    ]);
  });
});
