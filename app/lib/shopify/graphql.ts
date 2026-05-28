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
        title
        handle
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

export interface AdminGraphqlClient {
  graphql: (
    query: string,
    options?: {
      variables?: Record<string, unknown>;
    },
  ) => Promise<Response>;
}

export interface ShopifyCustomerSummary {
  id: string;
  numberOfOrders: string;
  amountSpent?: {
    amount: string;
    currencyCode: string;
  } | null;
  tags: string[];
  lastOrder?: {
    id: string;
    processedAt: string;
  } | null;
}

export interface ShopifyCustomerOrderSummary {
  id: string;
  processedAt: string;
  totalPriceSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    } | null;
  } | null;
  lineItems: {
    nodes: Array<{
      quantity: number;
      variant?: {
        id: string;
        title: string;
        product?: {
          id: string;
          productType: string;
          tags: string[];
        } | null;
      } | null;
    }>;
  };
}

export interface ShopifyReplenishmentOrderLineItem {
  title?: string;
  quantity: number;
  variant?: {
    id: string;
    title: string;
    product?: {
      id: string;
      title: string;
      tags: string[];
    } | null;
  } | null;
}

export interface ShopifyReplenishmentOrderSummary {
  id: string;
  processedAt: string;
  lineItems: {
    nodes: ShopifyReplenishmentOrderLineItem[];
  };
}

interface CustomerSummaryGraphqlResponse {
  data?: {
    customer?: ShopifyCustomerSummary | null;
  };
}

interface CustomerOrderSummaryGraphqlResponse {
  data?: {
    customer?: {
      orders: {
        nodes: ShopifyCustomerOrderSummary[];
      };
    } | null;
  };
}

interface CustomerReplenishmentHistoryGraphqlResponse {
  data?: {
    customer?: {
      orders: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor?: string | null;
        };
        nodes: ShopifyReplenishmentOrderSummary[];
      };
    } | null;
  };
}

export const CUSTOMER_SUMMARY_QUERY = `#graphql
  query getCustomerSummary($id: ID!) {
    customer(id: $id) {
      id
      numberOfOrders
      amountSpent {
        amount
        currencyCode
      }
      tags
      lastOrder {
        id
        processedAt
      }
    }
  }
`;

export const CUSTOMER_ORDER_SUMMARY_QUERY = `#graphql
  query getCustomerOrderSummary($id: ID!, $first: Int!) {
    customer(id: $id) {
      orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          processedAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 20) {
            nodes {
              quantity
              variant {
                id
                title
                product {
                  id
                  productType
                  tags
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const CUSTOMER_REPLENISHMENT_HISTORY_QUERY = `#graphql
  query getCustomerReplenishmentHistory($id: ID!, $first: Int!, $after: String) {
    customer(id: $id) {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          processedAt
          lineItems(first: 50) {
            nodes {
              title
              quantity
              variant {
                id
                title
                product {
                  id
                  title
                  tags
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchCustomerSummary(
  admin: AdminGraphqlClient,
  customerId: string,
): Promise<ShopifyCustomerSummary | null> {
  const response = await admin.graphql(CUSTOMER_SUMMARY_QUERY, {
    variables: { id: customerId },
  });
  const payload = await response.json() as CustomerSummaryGraphqlResponse;

  return payload.data?.customer ?? null;
}

export async function fetchCustomerOrderSummary(
  admin: AdminGraphqlClient,
  customerId: string,
  first = 10,
): Promise<ShopifyCustomerOrderSummary[]> {
  const response = await admin.graphql(CUSTOMER_ORDER_SUMMARY_QUERY, {
    variables: { id: customerId, first },
  });
  const payload = await response.json() as CustomerOrderSummaryGraphqlResponse;

  return payload.data?.customer?.orders.nodes ?? [];
}

export async function fetchCustomerReplenishmentOrderHistory(
  admin: AdminGraphqlClient,
  customerId: string,
  first = 25,
  after?: string,
): Promise<{
  orders: ShopifyReplenishmentOrderSummary[];
  hasNextPage: boolean;
  endCursor?: string;
}> {
  const response = await admin.graphql(CUSTOMER_REPLENISHMENT_HISTORY_QUERY, {
    variables: { id: customerId, first, after },
  });
  const payload = await response.json() as CustomerReplenishmentHistoryGraphqlResponse;
  const connection = payload.data?.customer?.orders;

  return {
    orders: connection?.nodes ?? [],
    hasNextPage: connection?.pageInfo.hasNextPage ?? false,
    ...(connection?.pageInfo.endCursor ? { endCursor: connection.pageInfo.endCursor } : {}),
  };
}
