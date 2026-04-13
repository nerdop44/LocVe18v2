from odoo import api, fields, models, _
import logging

_logger = logging.getLogger(__name__)

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None, **read_kwargs):
        # Pachacutec: v18.0.1.0.98 - ADMIN & GHOST COMPANY SHIELD
        # Resolvemos el bloqueo del Administrador (id=2) en entornos multi-empresa.
        # Si el Administrador está navegando configuraciones, permitimos la lectura as sudo() 
        # para evitar interrupciones por registros de empresas huérfanas o inactivas.
        if self.env.user.id == 2 or self.env.is_admin():
             try:
                 return super(HrEmployee, self.with_context(active_test=False)).search_read(
                     domain=domain, fields=fields, offset=offset, limit=limit, order=order, **read_kwargs
                 )
             except Exception:
                 return super(HrEmployee, self.sudo().with_context(active_test=False)).search_read(
                     domain=domain, fields=fields, offset=offset, limit=limit, order=order, **read_kwargs
                 )
        return super().search_read(domain=domain, fields=fields, offset=offset, limit=limit, order=order, **read_kwargs)

    def read(self, fields=None, load='_classic_read'):
        # Pachacutec: v18.0.1.0.98 - ADMIN SHIELD
        # Aseguramos que el Administrador pueda leer empleados incluso si pertenecen a compañías
        # no activas o inexistentes (fantasmas) desde la perspectiva del contexto actual.
        if self.env.user.id == 2 or self.env.is_admin():
            try:
                return super().read(fields=fields, load=load)
            except Exception:
                return super(HrEmployee, self.sudo()).read(fields=fields, load=load)
        return super().read(fields=fields, load=load)
