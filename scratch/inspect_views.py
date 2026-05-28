import xmlrpc.client

url = "https://animalc-prueba-31856092.dev.odoo.com"
db = "animalc-prueba-31856092"
username = "admin"
password = "1234"

try:
    common = xmlrpc.client.ServerProxy('{}/xmlrpc/2/common'.format(url))
    uid = common.authenticate(db, username, password, {})
    if not uid:
        print("Fallo de autenticación")
        exit()

    models = xmlrpc.client.ServerProxy('{}/xmlrpc/2/object'.format(url))
    
    # Busquemos todas las vistas que heredan de point_of_sale.report_saledetails o point_of_sale.pos_session_sales_details
    views = models.execute_kw(db, uid, password,
        'ir.ui.view', 'search_read',
        [[('arch_db', 'like', 'discounts')]],
        {'fields': ['id', 'name', 'key', 'model', 'type', 'inherit_id', 'active']})
        
    print(f"Encontradas {len(views)} vistas con 'discounts':")
    for v in views:
        print(f"ID: {v['id']}, Name: {v['name']}, Key: {v['key']}, Inherit: {v['inherit_id']}, Active: {v['active']}")
        # Leer el arch_db y buscar si tiene el xpath viejo
        full_view = models.execute_kw(db, uid, password, 'ir.ui.view', 'read', [v['id']], {'fields': ['arch_db']})
        arch = full_view[0]['arch_db']
        if 'Amount of discounts' in arch:
            print("  --> ¡Esta vista contiene 'Amount of discounts'!")
        if 'strong[contains(text()' in arch:
            print("  --> ¡Esta vista contiene 'strong[contains(text()'")
        print("-" * 30)

except Exception as e:
    print(f"Error: {e}")
