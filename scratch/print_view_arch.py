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
    
    view = models.execute_kw(db, uid, password, 'ir.ui.view', 'read', [2910], {'fields': ['name', 'key', 'arch_db', 'xml_id']})
    if view:
        with open('scratch/view_2910.xml', 'w') as f:
            f.write(view[0]['arch_db'])
        print("Guardado en scratch/view_2910.xml, xml_id:", view[0]['xml_id'])
    else:
        print("No se encontró la vista")

except Exception as e:
    print(f"Error: {e}")
