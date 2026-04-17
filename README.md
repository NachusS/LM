# Calculadora de Lactancia SMS 2026

Aplicación estática y responsive pensada para publicar directamente en GitHub Pages.

## Archivos incluidos

- `index.html`
- `styles.css`
- `app.js`
- `.nojekyll`

## Publicación rápida en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube el contenido de esta carpeta al repositorio.
3. En GitHub entra en **Settings > Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama principal y la carpeta **/** (root).
6. Guarda los cambios.
7. GitHub publicará la web y te mostrará la URL final.

## Uso

### Calculadora

- Introduce la fecha causante.
- Añade el fin del permiso principal si lo conoces.
- Indica la fecha de inicio real del disfrute.
- Marca el calendario semanal.
- Añade fechas o tramos no computables.

### OCR

- Sube una captura o imagen.
- La app intentará reconstruir filas con:
  - Tipo de Movimiento
  - Fecha Inicio
  - Fecha Fin
- Si la fecha fin está vacía, usa la fecha de consulta.
- Revisa la tabla.
- Pulsa **Pasar tabla al formulario**.

## Movimientos reconocidos de forma preferente

- ESTATUTARIO INTERINO
- INCORPORACION ESTATUTARIO
- PERMISO DE NACIMIENTO MADRE
- RIESGO DURANTE EL EMBARAZO
- ASUNTOS PARTICULARES
- CURSOS/FORMACION CONTINUADA
- HUELGA TOTAL

## Nota técnica

La funcionalidad OCR usa `tesseract.js` desde CDN en el navegador.
