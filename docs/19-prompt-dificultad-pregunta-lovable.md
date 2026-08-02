# Prompt para Lovable — Mostrar dificultad en la pregunta + corregir tipo

> Pega esto en el chat de Lovable. Ajusta `/examen` y `src/types/exam.ts`.

## Contexto

Comparamos contra una captura real de pmsimulador.com: muestran un badge de dificultad
("Media") junto al número de pregunta. Al revisarlo encontramos dos huecos nuestros:

1. `start_exam` no devolvía el campo `difficulty` en absoluto (ya corregido en el
   backend — cada ítem del array `items` que devuelve `start_exam` ahora incluye
   `difficulty`, un número del 1 al 5).
2. **Bug real de tipos**: `src/types/exam.ts` define `difficulty: 1 | 2 | 3`, pero el
   banco real tiene preguntas con `difficulty = 4` (confirmado por consulta directa a
   la base de datos: hay dificultad 2, 3 y 4 en las preguntas publicadas). Cualquier
   lógica que dependiera de ese tipo restringido a 3 valores podría no cubrir esas
   preguntas correctamente.

## 1. Corregir el tipo

En `src/types/exam.ts`, línea 97:

```diff
- difficulty: 1 | 2 | 3;
+ difficulty: 1 | 2 | 3 | 4 | 5;
```

## 2. Mostrar el badge de dificultad en la pregunta

En `examen.tsx`, junto a donde ya mostráis "PREGUNTA X" (o el número de pregunta),
añade un badge con la dificultad traducida a una etiqueta legible de 3 niveles (aunque
almacenemos 1-5 internamente, mostrar 5 niveles distintos al candidato no aporta y es
más ruido visual):

```ts
function difficultyLabel(d: number): string {
  if (d <= 2) return "Fácil";
  if (d === 3) return "Media";
  return "Difícil"; // 4 o 5
}
```

Estilo: badge discreto, mismo patrón visual que ya usáis para otros badges (tipo de
enfoque, dominio) — no hace falta que sea llamativo, es información de contexto.

## Qué no cambia

- La escala de almacenamiento sigue siendo 1-5 en base de datos (así generamos y
  clasificamos internamente con más granularidad de la que mostramos). Solo se traduce
  a 3 niveles en la interfaz.
- No hace falta tocar la lógica de generación de preguntas ni el panel de admin — ahí
  ya se usa correctamente la escala 1-5 completa.
