# Domain glossary

- **Tenant**: A merchant whose catalog, warehouses, variants, and inventory are isolated from every other merchant.
- **Product**: A tenant-owned catalog item that defines the allowed shape of its variants.
- **Variant schema**: A tenant-defined map of attribute names to string, number, or boolean constraints.
- **Variant**: A sellable SKU whose attributes satisfy its product's variant schema.
- **Warehouse**: A tenant-owned physical stock location.
- **Stock level**: The current quantity of one variant at one warehouse.
- **Inventory adjustment**: An immutable record of a quantity change and the resulting balance.

