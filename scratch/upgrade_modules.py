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
    
    # Buscar pos_show_dual_currency
    modules = models.execute_kw(db, uid, password,
        'ir.module.module', 'search_read',
        [[('name', 'in', ['pos_show_dual_currency', 'pos_igtf_tax'])]],
        {'fields': ['id', 'name', 'state']})
        
    print("Módulos encontrados:")
    for m in modules:
        print(f"ID: {m['id']}, Name: {m['name']}, State: {m['state']}")
        
    # Ejecutar upgrade
    module_ids = [m['id'] for m in modules]
    if module_ids:
        print("Ejecutando Upgrade...")
        res = models.execute_kw(db, uid, password,
            'ir.module.module', 'button_immediate_upgrade',
            [module_ids])
        print("Resultado del Upgrade:", res)
    else:
        print("No se encontraron los módulos.")

except Exception as e:
    print(f"Error: {e}")
