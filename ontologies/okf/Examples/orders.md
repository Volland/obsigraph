---
type: Table
title: orders
description: One row per customer order, loaded hourly from the shop database.
resource: bigquery://shop/sales/orders
tags: [sales, core]
grain: one row per order
---
## Links

owned_by:: [[Dana Ortiz]]
derived_from:: [[raw_orders]] {transform: "deduplicated on order_id"}
