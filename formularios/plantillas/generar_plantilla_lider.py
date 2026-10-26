"""Genera Multitienda-Lider-Datos-iniciales.xlsx (copia sincronizada a mano de la planilla de Lider en apps-script/relevamiento.gs; las instrucciones finales difieren a propósito porque el xlsx se manda por WhatsApp). Uso: python3 generar_plantilla_lider.py [salida.xlsx]  (requiere openpyxl)."""
import sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

CATEGORIAS = [
    'Refrigeradores', 'Freezers', 'Lavadoras', 'Secadoras', 'Cocinas',
    'Hornos y microondas', 'Campanas', 'Calefones y termotanques', 'Climatización',
    'Televisores', 'Audio', 'Celulares y tablets', 'Computación',
    'Pequeños electrodomésticos', 'Muebles', 'Colchones', 'Motos y bicicletas',
]
COLUMNAS_PRODUCTOS = [
    'Código interno', 'Código de barras', 'Descripción', 'Marca', 'Modelo', 'Categoría', 'Línea',
    'Precio costo (Bs)', 'Precio contado (Bs)', 'Precio crédito (Bs)', 'Precio mínimo (Bs)',
    'Stock actual', 'Stock mínimo', '¿Controla nro. de serie?', 'Garantía (meses)', 'Observaciones',
]
PRECIOS = ['Precio costo (Bs)', 'Precio contado (Bs)', 'Precio crédito (Bs)', 'Precio mínimo (Bs)']
NUMERICAS = PRECIOS + ['Stock actual', 'Stock mínimo', 'Garantía (meses)']
HOJAS = [
    ('Productos', COLUMNAS_PRODUCTOS, [
        ['REF-001', '7790000000011', 'Refrigerador no frost 300 L', 'Marca Ejemplo', 'RF-300', 'Refrigeradores', 'Línea blanca', 2800, 3500, 3900, 3300, 4, 1, 'Sí', 12, 'EJEMPLO — borrar'],
        ['TV-002', '7790000000028', 'Televisor LED 43 pulgadas', 'Marca Ejemplo', 'TV-43', 'Televisores', 'Línea negra', 1500, 1900, 2100, 1800, 6, 2, 'Sí', 12, 'EJEMPLO — borrar'],
    ]),
    ('Números de serie', ['Código interno', 'Número de serie', 'Ubicación'],
     [['REF-001', 'SN-0001', 'Tienda (EJEMPLO — borrar)'], ['REF-001', 'SN-0002', 'Depósito (EJEMPLO — borrar)']]),
    ('Clientes', ['Nombre', 'CI o NIT', 'Teléfono', 'Dirección', 'Saldo de crédito pendiente (Bs)'], []),
    ('Usuarios', ['Nombre', 'Cargo', 'Celular', 'Correo', 'Negocio(s)', 'Rol'], []),
    ('Categorías', ['Categoría'], []),
]
INSTRUCCIONES = [
    'Planilla de datos iniciales - Multitienda Lider',
    '',
    'Esta planilla sirve para pasarnos su información. Llene solo lo que tenga; lo demás puede quedar en blanco.',
    '1. Productos: una fila por producto. Las filas grises que dicen EJEMPLO son solo para guiarle: bórrelas.',
    '2. Números de serie: solo para los productos donde anota el número de serie de cada unidad. Una fila por unidad.',
    '3. Clientes (opcional): si tiene una lista de clientes o saldos de crédito pendientes.',
    '4. Usuarios: las personas que usarían el sistema, con su cargo.',
    '5. Categorías: la lista que aparece en el desplegable de Productos. Puede agregar o cambiar categorías.',
    '',
    'Los precios y el stock deben ser números de cero o más. La planilla no deja escribir otra cosa.',
    'Cuando termine, guarde el archivo y mándelo por WhatsApp.',
]
ULTIMA = 1000  # filas 2..1000
ANCHOS = {'Descripción': 40, 'Observaciones': 40}
FONDO = PatternFill('solid', fgColor='DCE6F1')
GRIS = Font(color='999999')


def lista(formula):
    return DataValidation(type='list', formula1=formula, allow_blank=True, showErrorMessage=True,
                          errorTitle='Valor no válido', error='Elija una opción de la lista.')


def numero():
    return DataValidation(type='decimal', operator='greaterThanOrEqual', formula1='0', allow_blank=True,
                          showErrorMessage=True, errorTitle='Número no válido',
                          error='Escriba un número de 0 o más.')


def construir(destino):
    wb = Workbook()
    ins = wb.active
    ins.title = 'Instrucciones'
    for i, linea in enumerate(INSTRUCCIONES, 1):
        c = ins.cell(i, 1, linea)
        c.alignment = Alignment(wrap_text=True, vertical='top')
    ins['A1'].font = Font(bold=True, size=16)
    ins.column_dimensions['A'].width = 100

    hojas = {}
    for nombre, cols, ejemplos in HOJAS:
        ws = wb.create_sheet(nombre)
        hojas[nombre] = ws
        for j, t in enumerate(cols, 1):
            c = ws.cell(1, j, t)
            c.font = Font(bold=True)
            c.fill = FONDO
            c.alignment = Alignment(wrap_text=True, vertical='center')
            ws.column_dimensions[get_column_letter(j)].width = ANCHOS.get(t, 20)
        ws.freeze_panes = 'A2'
        ws.auto_filter.ref = f'A1:{get_column_letter(len(cols))}1'
        if nombre == 'Productos':  # texto ANTES de escribir ejemplos
            for r in range(2, ULTIMA + 1):
                for j in (1, 2):
                    ws.cell(r, j).number_format = '@'
            for t in PRECIOS:
                for r in range(2, ULTIMA + 1):
                    ws.cell(r, cols.index(t) + 1).number_format = '#,##0.00'
        for i, fila in enumerate(ejemplos, 2):
            for j, v in enumerate(fila, 1):
                ws.cell(i, j, v).font = GRIS

    for i, cat in enumerate(CATEGORIAS, 2):
        hojas['Categorías'].cell(i, 1, cat)

    def validar(ws, cols, nombre, dv):
        ws.add_data_validation(dv)
        L = get_column_letter(cols.index(nombre) + 1)
        dv.add(f'{L}2:{L}{ULTIMA}')

    p = hojas['Productos']
    validar(p, COLUMNAS_PRODUCTOS, 'Categoría', lista("'Categorías'!$A$2:$A$200"))
    validar(p, COLUMNAS_PRODUCTOS, 'Línea', lista('"Línea blanca,Línea negra,Pequeños electrodomésticos,Otros"'))
    validar(p, COLUMNAS_PRODUCTOS, '¿Controla nro. de serie?', lista('"Sí,No"'))
    for n in NUMERICAS:
        validar(p, COLUMNAS_PRODUCTOS, n, numero())
    cl = HOJAS[2]
    validar(hojas['Clientes'], cl[1], 'Saldo de crédito pendiente (Bs)', numero())
    for r in range(2, ULTIMA + 1):  # saldo en 2 decimales
        hojas['Clientes'].cell(r, 5).number_format = '#,##0.00'
    wb.save(destino)


if __name__ == '__main__':
    construir(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('Multitienda-Lider-Datos-iniciales.xlsx'))
