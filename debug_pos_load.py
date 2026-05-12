
import logging
from odoo import api, SUPERUSER_ID

def debug_pos():
    print(">>> Iniciando diagnóstico de carga de POS...")
    try:
        # Simular una carga de datos para el POS config ID 1 (ajustar si es otro)
        config = self.env['pos.config'].search([], limit=1)
        if not config:
            print("ERROR: No se encontró ninguna configuración de POS.")
            return
        
        print(f">>> Probando carga para POS: {config.name} (ID: {config.id})")
        
        # En Odoo 18, el POS carga datos a través de este flujo
        data = {
            'version': '18.0',
            'config_id': config.id,
        }
        
        # Intentar ejecutar la carga de datos
        res = config._load_pos_data(data)
        print(">>> ÉXITO: Los datos se cargaron correctamente en el servidor.")
        print(f">>> Claves recibidas: {res.keys() if res else 'None'}")
        
    except Exception as e:
        print(f"!!! FALLO DETECTADO: {str(e)}")
        import traceback
        traceback.print_exc()

debug_pos()
