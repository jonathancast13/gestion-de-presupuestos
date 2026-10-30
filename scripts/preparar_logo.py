"""Genera los activos del logo de la empresa a partir del original.

Uso:
    python scripts/preparar_logo.py [ruta_origen]

Por defecto toma %USERPROFILE%\\Downloads\\oswaldo.jpeg y crea:

- frontend/assets/logo-empresa.png              (RGB, fondo negro, máx. 1024px)
- frontend/assets/logo-empresa-transparente.png (PNG con alfa por luminancia)
- frontend/public/icons/icon-192.png
- frontend/public/icons/icon-512.png
- frontend/public/icons/icon-maskable-512.png
- frontend/public/icons/apple-touch-icon.png (180px)

La variante transparente usa la luminancia como canal alfa: el fondo negro
desaparece y el glyph dorado se mantiene opaco, ideal para cabeceras y
marcas de agua sobre papel blanco.
"""

from __future__ import annotations

import os
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CARPETA_ACTIVOS = RAIZ / 'frontend' / 'assets'
CARPETA_ICONOS = RAIZ / 'frontend' / 'public' / 'icons'

# Color de lienzo de los iconos: debe coincidir con colorOscuro de empresa.ts
CARBON = (15, 17, 19)


def origen_por_defecto() -> pathlib.Path:
    descargas = pathlib.Path(os.environ.get('USERPROFILE', '')) / 'Downloads'
    return descargas / 'oswaldo.jpeg'


def recortar_margenes_negros(imagen: Image.Image, umbral: int = 18) -> Image.Image:
    """Recorta el marco negro plano dejando solo la zona con contenido."""
    gris = imagen.convert('L')
    mascara = gris.point(lambda p: 255 if p > umbral else 0)
    contorno = mascara.getbbox()
    if not contorno:
        return imagen
    # Pequeño margen para conservar el resplandor
    margen = 8
    izq, sup, der, inf = contorno
    caja = (
        max(0, izq - margen),
        max(0, sup - margen),
        min(imagen.width, der + margen),
        min(imagen.height, inf + margen),
    )
    return imagen.crop(caja)


def escalar(imagen: Image.Image, lado_max: int) -> Image.Image:
    if max(imagen.size) <= lado_max:
        return imagen.copy()
    ratio = lado_max / max(imagen.size)
    nuevo = (round(imagen.width * ratio), round(imagen.height * ratio))
    return imagen.resize(nuevo, Image.LANCZOS)


def a_transparente(imagen: Image.Image) -> Image.Image:
    """Fondo negro -> transparente usando la luminancia como alfa."""
    rgb = imagen.convert('RGB')
    luminancia = rgb.convert('L')
    # Suavizado leve para no cortar el resplandor de forma abrupta
    luminancia = luminancia.filter(ImageFilter.GaussianBlur(radius=0.6))
    salida = rgb.copy()
    salida.putalpha(luminancia)
    return salida


def guardar(imagen: Image.Image, ruta: pathlib.Path) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    imagen.save(ruta, optimize=True)
    kb = ruta.stat().st_size / 1024
    print(f'  {ruta.relative_to(RAIZ)}  {imagen.size[0]}x{imagen.size[1]}  {kb:.0f} KB')


def icono_con_fondo(imagen: Image.Image, lado: int, relleno: float) -> Image.Image:
    """Logo centrado sobre fondo carbón con padding (para PWA / apple-touch).

    `imagen` debe ser la variante transparente para que el halo negro del
    original se funda con el lienzo en lugar de mostrar un rectángulo.
    """
    lienzo = Image.new('RGBA', (lado, lado), CARBON + (255,))
    area = int(lado * (1 - relleno))
    mini = escalar(imagen, area)
    x = (lado - mini.width) // 2
    y = (lado - mini.height) // 2
    lienzo.alpha_composite(mini, (x, y))
    return lienzo.convert('RGB')


def main() -> int:
    origen = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else origen_por_defecto()
    if not origen.exists():
        print(f'No se encuentra el logo de origen: {origen}')
        return 1

    print(f'Origen: {origen}')
    base = Image.open(origen).convert('RGB')
    recortada = recortar_margenes_negros(base)

    # Variante transparente: única fuente para PDF, login, PWA y marca de agua
    transparente = a_transparente(escalar(recortada, 768))
    guardar(transparente, CARPETA_ACTIVOS / 'logo-empresa-transparente.png')

    print('Iconos PWA:')
    for lado, nombre, relleno in (
        (192, 'icon-192.png', 0.14),
        (512, 'icon-512.png', 0.14),
        (512, 'icon-maskable-512.png', 0.30),
        (180, 'apple-touch-icon.png', 0.16),
    ):
        guardar(icono_con_fondo(transparente, lado, relleno), CARPETA_ICONOS / nombre)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
