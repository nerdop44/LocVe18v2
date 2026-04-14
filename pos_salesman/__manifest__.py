{
    "name": "[LOCVE] Vendedor en POS",
    'summary': """
        Agrega un campo vendedor en POS
        """,
    'author': 'José Luis Vizcaya López remake Ing Nerdo Pulido',
    'company': 'José Luis Vizcaya López remake Ing Nerdo Pulido',
    'maintainer': 'José Luis Vizcaya López remake Ing Nerdo Pulido',
    'website': 'https://github.com/birkot',
    'category': 'Point of Sale',
    "version": "18.0.1.0.54",
    'depends': ['hr', 'point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'views/pos_config.xml',
        'views/pos_order_view.xml',
        'views/res_config_settings_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_salesman/static/src/app/**/*',
        ],
    },
    'license': 'LGPL-3',
    'installable': True,
}
