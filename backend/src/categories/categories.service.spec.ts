import { ConflictException } from "@nestjs/common";
import { CategoriesService } from "./categories.service";

function setup() {
  const prisma = {
    category: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    $transaction: jest.fn()
  };
  const cache = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(),
    del: jest.fn()
  };
  const categoryTree = {
    getDescendantIds: jest.fn().mockResolvedValue([]),
    getPublicTree: jest.fn().mockResolvedValue([]),
    findPublicCategoryBySlug: jest.fn(),
    flattenPublicTree: jest.fn()
  };
  return {
    service: new CategoriesService(prisma as never, cache as never, categoryTree as never),
    prisma,
    cache,
    categoryTree
  };
}

describe("CategoriesService hierarchy safety", () => {
  it("rejects moving a category beneath one of its descendants", async () => {
    const { service, prisma, categoryTree } = setup();
    prisma.category.findUnique.mockResolvedValueOnce({ id: "parent" });
    categoryTree.getDescendantIds.mockResolvedValue(["child", "grandchild"]);

    await expect(service.update("parent", { parentId: "grandchild" })).rejects.toThrow(
      new ConflictException("Category cannot be moved under one of its descendants.")
    );
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("rejects deleting a category that still has children", async () => {
    const { service, prisma } = setup();
    prisma.category.findUnique.mockResolvedValue({
      id: "parent",
      products: [],
      children: [{ id: "child" }]
    });

    await expect(service.remove("parent")).rejects.toThrow(
      new ConflictException("Cannot delete category with child categories.")
    );
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it("uses the authoritative public tree for the visible endpoint", async () => {
    const { service, categoryTree } = setup();
    categoryTree.getPublicTree.mockResolvedValue([{ id: "root", children: [] }]);
    await expect(service.findTree({ onlyVisible: true })).resolves.toEqual([
      { id: "root", children: [] }
    ]);
  });
});
