import logging
_logger = logging.getLogger(__name__)

def run_diag(env):
    print("--- DIAGNÓSTICO DE UOM ---")
    
    # 1. Buscar UOMs sospechosas
    all_uoms = env['uom.uom'].search([])
    for uom in all_uoms:
        if 'kg' in uom.name.lower() or 'und' in uom.name.lower() or 'unit' in uom.name.lower():
            print(f"UOM: {uom.name} (ID: {uom.id}) - Categoría: {uom.category_id.name} (ID: {uom.category_id.id})")

    # 2. Buscar el producto del error
    # Según logs previos el producto era DT-PEDCH o ID 6209?
    product = env['product.product'].search([('default_code', '=', 'DT-PEDCH')], limit=1)
    if not product:
        product = env['product.product'].search([('id', '=', 6209)], limit=1)
    
    if product:
        print(f"PRODUCTO ENCONTRADO: {product.display_name}")
        print(f"  UOM Venta: {product.uom_id.name} (Cat: {product.uom_id.category_id.name})")
        print(f"  UOM Compra: {product.uom_po_id.name} (Cat: {product.uom_po_id.category_id.name})")
        print(f"  Template UOM: {product.product_tmpl_id.uom_id.name} (Cat: {product.product_tmpl_id.uom_id.category_id.name})")
    else:
        print("PRODUCTO DT-PEDCH NO ENCONTRADO EN ESTE ENTORNO")

    # 3. Buscar discrepancias generales
    discrepancias = env['product.product'].search([]).filtered(lambda p: p.uom_id.category_id != p.product_tmpl_id.uom_id.category_id)
    print(f"Total variantes con discrepancia física: {len(discrepancias)}")
    for d in discrepancias[:5]:
        print(f"  {d.display_name}: V({d.uom_id.name}) vs T({d.product_tmpl_id.uom_id.name})")

