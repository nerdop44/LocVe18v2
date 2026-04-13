def run_sql(env):
    print("--- INSPECCIÓN SQL product_product ---")
    
    # 1. Verificación de existencia de columna física
    env.cr.execute("""
        SELECT count(*) FROM information_schema.columns 
        WHERE table_name = 'product_product' AND column_name = 'uom_id'
    """)
    exists = env.cr.fetchone()[0]
    print(f"Columna física uom_id en product_product: {'SÍ' if exists else 'NO'}")
    
    if exists:
        # Buscar productos con 'kg'
        env.cr.execute("""
            SELECT p.id, p.default_code, p.uom_id as variant_uom, t.uom_id as template_uom
            FROM product_product p
            JOIN product_template t ON p.product_tmpl_id = t.id
            WHERE p.uom_id IS NOT NULL AND p.uom_id != t.uom_id
            LIMIT 10
        """)
        rows = env.cr.fetchall()
        print(f"Discrepancias físicas halladas: {len(rows)}")
        for r in rows:
            print(f"  ID: {r[0]} | Code: {r[1]} | Var: {r[2]} | Tmpl: {r[3]}")
    
    # Verificación de categorías
    env.cr.execute("""
        SELECT u.id, u.name, c.name 
        FROM uom_uom u 
        JOIN uom_category c ON u.category_id = c.id 
        WHERE u.name ILIKE 'kg' OR u.name ILIKE '%unid%'
    """)
    print("--- UNIDADES Y CATEGORÍAS ---")
    for r in env.cr.fetchall():
        print(f"  ID: {r[0]} | Name: {r[1]} | Cat: {r[2]}")

