# Prompt para Lovable — Numeración de preguntas + motivo de rechazo al retirar

> Backend listo, desplegado y verificado con datos reales de principio a fin. Esto
> es puramente frontend, en `admin.review.tsx` (y `QuestionDetailDialog.tsx` si
> también permite retirar preguntas ahí).

## Contexto

El PO está revisando el banco de preguntas una a una para decidir si tienen
calidad suficiente. Pidió dos cosas:

1. Ver cada pregunta numerada (para poder referenciarla, ej. "la pregunta #47").
2. Al retirar una pregunta, poder escribir por qué la rechaza — ese motivo se
   guarda y alimenta automáticamente la generación futura para no repetir los
   mismos errores (esto último ya funciona en el backend sin que el frontend
   tenga que hacer nada más).

## 1. Numeración — nuevo campo `question_number`

`AdminQuestion` y `QuestionStatRow` (en `adminService.ts`) ya devuelven
`question_number: number` desde `admin_questions` (vía `v_question_stats`). Añade
el campo al tipo si no está:

```ts
export interface AdminQuestion {
  // ...campos existentes...
  question_number: number;
}
```

Muéstralo en `admin.review.tsx`: añade una columna o un badge tipo `#47` al
principio de cada fila del listado (antes del enunciado), y también en el detalle
expandido/`QuestionDetailDialog.tsx`. Es un número fijo — no lo calcules a partir
de la posición en la lista (eso cambiaría si se filtra o pagina), usa siempre el
valor de `question_number` que ya viene del backend.

## 2. Modal de motivo al retirar

Busca dónde hoy se llama a "retirar" una pregunta (probablemente un botón que
llama a `updateQuestionStatus(id, "retired")` o similar en `adminService.ts`).
Antes de ejecutar esa llamada, muestra un modal simple:

```tsx
// Ejemplo de estructura del modal
<Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Retirar pregunta #{question.question_number}</DialogTitle>
      <DialogDescription>
        Esta pregunta no se borra, queda retirada del banco. Explica brevemente
        por qué no tiene calidad suficiente — este motivo se usará automáticamente
        para mejorar la generación de preguntas futuras de esta misma tarea.
      </DialogDescription>
    </DialogHeader>
    <Textarea
      placeholder="Ej: El distractor C es demasiado obvio, cualquier candidato lo descarta sin razonar."
      value={reason}
      onChange={(e) => setReason(e.target.value)}
      rows={3}
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
      <Button
        variant="destructive"
        disabled={!reason.trim()}
        onClick={handleConfirmReject}
      >
        Retirar pregunta
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 3. Actualizar `adminService.ts` — pasar el motivo

`updateQuestionStatus` (o como se llame la función que hace el PATCH a
`admin_questions`) necesita aceptar y enviar `reason`:

```ts
export async function updateQuestionStatus(
  questionIds: string[],
  status: "draft" | "published" | "retired",
  reason?: string, // NUEVO -- solo se usa cuando status === "retired"
) {
  const { data, error } = await supabase.functions.invoke("admin_questions", {
    method: "PATCH",
    body: { question_ids: questionIds, status, reason },
  });
  if (error) throw error;
  return data;
}
```

El backend ya acepta `reason` en el body del PATCH y lo guarda automáticamente en
`question_rejections` cuando `status === "retired"` y `reason` no está vacío — no
hace falta ninguna llamada adicional desde el frontend.

## 4. (Opcional, útil) Mostrar el motivo si la pregunta ya está retirada

`v_question_stats` ahora también expone `latest_rejection_reason` (el motivo más
reciente si la pregunta está retirada, `null` si no). Si quieres, muéstralo en el
detalle de una pregunta ya retirada, para que el PO pueda recordar por qué la
rechazó sin tener que consultar otra pantalla:

```tsx
{question.status === "retired" && question.latest_rejection_reason && (
  <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
    <span className="font-medium">Motivo del rechazo: </span>
    {question.latest_rejection_reason}
  </div>
)}
```

## Resumen de archivos a tocar

| Archivo | Qué cambia |
|---|---|
| `src/services/adminService.ts` | `question_number` en los tipos; `reason` opcional en `updateQuestionStatus` |
| `src/routes/admin.review.tsx` | Mostrar `#numero`; modal de motivo antes de retirar |
| `src/components/admin/QuestionDetailDialog.tsx` | Mismo número + (opcional) mostrar `latest_rejection_reason` si está retirada |
