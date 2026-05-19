import { describe, it, expect } from "vitest";
import { normalizeProduct, ShopifyProductNode } from "../../../app/lib/knowledge-graph/normalization";

describe("normalizeProduct", () => {
  it("should filter out non-active products", () => {
    const draftProduct: ShopifyProductNode = {
      id: "gid://shopify/Product/1",
      title: "Draft Product",
      handle: "draft",
      status: "DRAFT",
    };

    const result = normalizeProduct(draftProduct);
    expect(result).toBeNull();
  });

  it("should extract custom and cartmind metafields correctly", () => {
    const product: ShopifyProductNode = {
      id: "gid://shopify/Product/2",
      title: "Active Product",
      handle: "active",
      status: "ACTIVE",
      metafields: {
        nodes: [
          { namespace: "custom", key: "discipline", value: "Boxing" },
          { namespace: "cartmind", key: "score", value: "95" },
          { namespace: "global", key: "title_tag", value: "SEO title" }
        ]
      }
    };

    const result = normalizeProduct(product);
    expect(result).not.toBeNull();
    expect(result?.metafields).toEqual({
      "custom.discipline": "Boxing",
      "cartmind.score": "95"
    });
    expect(result?.disciplineTags).toContain("Boxing");
  });
});
