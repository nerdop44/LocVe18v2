{
    'name': '[LOCVE] Venezuela: POS IGTF',
    "version": "18.0.0.75",
    'author': 'Remake Ing Nerdo Pulido',
    'company': 'José Luis Vizcaya López remake Ing Nerdo Pulido',
    'maintainer': 'José Luis Vizcaya López remake Ing Nerdo Pulido',
    'website': 'https://github.com/birkot',
    'category': 'LocVe [Localization]',
    'summary': 'IGTF en el POS',
    'depends': ['point_of_sale','pos_show_dual_currency'],
    'data': [
        'views/inherited_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_igtf_tax/static/src/scss/**/*',
            'pos_igtf_tax/static/src/app/**/*.js',
            'pos_igtf_tax/static/src/app/**/*.xml',
        ],
    },
    'license': 'LGPL-3',
    'installable': True,
}
