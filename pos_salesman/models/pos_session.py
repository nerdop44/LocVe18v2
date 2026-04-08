from odoo import models, api, fields

class PosSession(models.Model):
    _inherit = 'pos.session'

    @api.model
    def _load_pos_data(self):
        """
        Pachacutec: v197.2 - Auditoría Profunda.
        Reemplazamos el método obsoleto 'load_data' por el cargador reactivo de Odoo 18.
        Inyectamos directamente 'hr_salesmen' en el diccionario de respuesta para asegurar disponibilidad en el frontend.
        """
        result = super()._load_pos_data()
        
        # Carga reactiva de vendedores (HR Employees)
        salesmen = self.env['hr.employee'].search_read(
            [('active', '=', True)], 
            ['id', 'name', 'work_email']
        )
        
        # Inyectamos en el diccionario raíz para mayor compatibilidad
        result['hr_salesmen'] = salesmen
        
        return result

    @api.model
    def _load_pos_data_fields(self, config_id):
        # Aseguramos que los campos necesarios estén disponibles si se requieren extensiones
        return super()._load_pos_data_fields(config_id)
