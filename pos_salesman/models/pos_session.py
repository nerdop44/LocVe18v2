from odoo import models, api, fields

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    # Pachacutec: v81 - ELIMINADO cargador vacío para estabilidad.

    # Pachacutec: v205 - ELIMINADO filtro de dominio restrictivo.
    # El filtrado de vendedores se debe manejar solo en el frontend (BtnSalesMan.js)
    # para no bloquear la carga de cajeros/managers legítimos en Odoo 18.