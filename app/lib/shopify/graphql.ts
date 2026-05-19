export const PRODUCT_FRAGMENT = `#graphql
  fragment ProductFields on Product {
    id
    title
    description
    handle
    vendor
    productType
    status
    tags
    images(first: 1) {
      nodes {
        url
      }
    }
    collections(first: 10) {
      nodes {
        id
      }
    }
  }
`;

export const VARIANT_FRAGMENT = `#graphql
  fragment VariantFields on ProductVariant {
    id
    title
    sku
    price
    compareAtPrice
    inventoryQuantity
    image {
      url
    }
    selectedOptions {
      name
      value
    }
  }
`;

export const METAFIELD_FRAGMENT = `#graphql
  fragment MetafieldFields on Metafield {
    id
    namespace
    key
    value
    type
  }
`;

export const PRODUCTS_QUERY = `#graphql
  ${PRODUCT_FRAGMENT}
  ${VARIANT_FRAGMENT}
  ${METAFIELD_FRAGMENT}
  query getProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...ProductFields
        variants(first: 100) {
          nodes {
            ...VariantFields
          }
        }
        metafields(first: 20) {
          nodes {
            ...MetafieldFields
          }
        }
      }
    }
  }
`;

export const PRODUCT_BY_ID_QUERY = `#graphql
  ${PRODUCT_FRAGMENT}
  ${VARIANT_FRAGMENT}
  ${METAFIELD_FRAGMENT}
  query getProductById($id: ID!) {
    product(id: $id) {
      ...ProductFields
      variants(first: 100) {
        nodes {
          ...VariantFields
        }
      }
      metafields(first: 20) {
        nodes {
          ...MetafieldFields
        }
      }
    }
  }
`;
