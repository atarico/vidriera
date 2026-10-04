# Vidriera

Un catálogo online para un comercio local, con costo de operación casi nulo: búsqueda
de productos con filtros y pedido por WhatsApp con un solo toque, **sin checkout, sin
comisiones y sin cuota mensual**. Es una alternativa directa a pagar una suscripción a
Tienda Nube o una comisión por venta a Mercado Libre, pensada para un negocio que solo
necesita que la gente encuentre un producto y le escriba al dueño.

**Demo en vivo:** https://d2yzoeqa5wtiks.cloudfront.net

## Cómo funciona

- **Carga de productos.** El dueño los edita en **Sanity Studio**.
- **Indexado.** Cuando publica un producto, Sanity dispara un webhook. Una Lambda
  (**ingest**) verifica la firma y lo encola en **SQS**. Después otra Lambda
  (**indexer**) optimiza las imágenes con **Cloudinary** y sube el producto a
  **Algolia**. Los mensajes que fallan van a una cola de errores (**DLQ**), y la Lambda
  **replay** los vuelve a encolar.
- **Tienda.** Es un sitio estático hecho con **Astro + React**, alojado en
  **S3 + CloudFront**. Ninguna parte del tráfico de clientes pasa por un servidor: las
  páginas son HTML estático y la búsqueda va directo a Algolia con una clave de solo
  lectura. Al tocar un producto se abre WhatsApp con un mensaje ya escrito.
- **Reindexado completo.** Cuando hace falta reindexar todo, se lanza a demanda una
  tarea en **ECS Fargate**, que termina sola. No es un servicio prendido 24/7.
- **Costos.** Toda la infraestructura está en **Terraform** y tiene una **alarma de
  presupuesto en USD 1**.

**Lo más interesante:** sirve para cualquier rubro (ferretería, panadería, vivero, lo
que sea). El rubro se define editando un solo archivo,
[`packages/contracts/src/rubro.ts`](packages/contracts/src/rubro.ts), y de ahí salen
automáticamente los campos del schema, los filtros y los facets.

Es un **monorepo con pnpm**, con arquitectura hexagonal en
[`packages/catalog-core`](packages/catalog-core).

```
┌──────────────┐  webhook   ┌────────┐  SQS   ┌─────────┐  upsert   ┌─────────┐
│ Sanity Studio │──────────▶│ ingest │───────▶│ indexer │──────────▶│ Algolia │
│ (edición)     │  (Lambda) │(Lambda)│ (cola) │ (Lambda)│(imágenes  │ (índice │
└──────────────┘            └────────┘        └────┬────┘ Cloudinary)│búsqueda)│
                                                     │ falla         └────┬────┘
                                                     │ maxReceiveCount    │
                                                     ▼                    │
                                              ┌─────────────┐            │
                                              │     DLQ     │            │
                                              │ (en espera) │            │
                                              └──────┬──────┘            │
                                                      │ manual/programado│
                                                      ▼                  │
                                                ┌──────────┐             │
                                                │  replay  │─────────────┘
                                                │ (Lambda) │  vuelve a la cola principal
                                                └──────────┘

┌──────────────────┐  recorrido completo    ┌─────────┐
│  reindex-worker   │───────────────────────▶│ Algolia │   (ECS Fargate, a demanda,
│ (tarea ECS Fargate)│  con límite de ritmo   └─────────┘    no un servicio 24/7)
└────────────────────┘

┌───────────┐  búsqueda      ┌──────────────────┐
│  Cliente   │◀──────────────▶│  Tienda Astro     │  (estática, S3 + CloudFront,
│ (celular)  │ toque→WhatsApp │  + isla React     │   clave de Algolia de lectura)
└───────────┘                └───────────────────┘
```

Por qué está armado así (por ejemplo, por qué el indexer es una Lambda pero el
reindexado completo es una tarea de ECS, y para qué existe replay) se explica en
[`docs/architecture.md`](docs/architecture.md).

## Estructura del repositorio

| Ruta | Qué es |
|------|--------|
| `packages/contracts` | Tipos compartidos (`CatalogRecord`, `RubroProfile`) y las funciones puras de las que deriva todo lo demás. **El único archivo a editar para un rubro nuevo: `src/rubro.ts`.** |
| `packages/catalog-core` | Lógica de dominio hexagonal que comparten el indexer y el reindex worker (mapeo, idempotencia, adaptadores de Algolia, Cloudinary y Sanity). |
| `apps/studio` | Sanity Studio v6, donde el dueño edita los productos. |
| `apps/storefront` | La tienda pública en Astro + React que navegan los clientes. |
| `services/ingest` | Lambda: verifica la firma del webhook de Sanity y encola en SQS. |
| `services/indexer` | Lambda: consume la cola, genera las imágenes con Cloudinary y escribe en Algolia. |
| `services/replay` | Lambda: vacía la cola de errores y devuelve los mensajes a la cola principal. |
| `services/reindex-worker` | Tarea de ECS Fargate: reindexado completo de todos los documentos de Sanity, con límite de ritmo. |
| `infra/terraform` | Toda la infraestructura de AWS, incluida la alarma de presupuesto en USD 1. |
| `docs/` | Referencia de credenciales, checklist de creación de cuentas, fundamentos de la arquitectura y runbook operativo. |

## Correrlo localmente

Requiere Node ≥22.12 y pnpm (la versión exacta está fijada en el campo
`packageManager` de `package.json`; `corepack enable` la toma automáticamente).

```bash
pnpm install
pnpm test          # pnpm vitest run: todos los tests unitarios, sin cuentas de AWS, Sanity ni Algolia
pnpm typecheck
pnpm lint
```

Para correr una sola app:

```bash
pnpm --filter @vidriera/studio dev        # Sanity Studio, necesita las variables SANITY_STUDIO_*
pnpm --filter @vidriera/storefront dev    # tienda Astro, necesita las variables PUBLIC_ALGOLIA_*
pnpm --filter @vidriera/storefront build  # build estático de producción
```

**El repositorio no incluye ningún archivo `.env`**: los secretos no van en el repo.
Todas las variables que lee cada servicio (para qué sirven, de dónde sacarlas y si son
secretas) están documentadas en [`docs/environment.md`](docs/environment.md). Sin
variables de entorno, la tienda igual buildea: muestra un estado de "todavía no
configurado" en lugar de romperse.

## Deploy

Hay tres partes que se deployan por separado:

1. **Sanity Studio**: `pnpm --filter @vidriera/studio run deploy`, con
   `SANITY_STUDIO_PROJECT_ID` y `SANITY_STUDIO_DATASET` definidas (necesita una cuenta
   de Sanity; se aloja gratis en la infraestructura de Sanity).
2. **Infraestructura**: `terraform apply` desde `infra/terraform`, después de completar
   `terraform.tfvars` (copiado de `terraform.tfvars.example`). Crea las colas, las
   Lambdas, el cluster de ECS y el hosting de la tienda en S3 + CloudFront.
3. **Build estático de la tienda**: `pnpm --filter @vidriera/storefront build`, después
   `aws s3 sync apps/storefront/dist s3://<storefront_bucket_name> --delete` y una
   invalidación de CloudFront. El nombre del bucket y el ID de la distribución salen de
   `terraform output`.

El checklist completo y ordenado para crear las cuentas y deployar (empezando por la
alarma de presupuesto, antes de cualquier `terraform apply`) está en
[`docs/setup.md`](docs/setup.md). La operación del día a día (replay de la cola de
errores, reindexado completo, control de costos) está en
[`docs/runbook.md`](docs/runbook.md).

## Qué falta

La plataforma está deployada y verificada de punta a punta (ver la sección
"Deployment" de [`odd/tasks/catalog-platform.md`](odd/tasks/catalog-platform.md)).
Queda:

- Reemplazar `packages/contracts/src/rubro.ts` por el rubro real del negocio (campos y
  facets) cuando esté definido. No hace falta tocar ningún otro archivo.
- Cambiar el número de WhatsApp provisorio por el del negocio y agregar un dominio
  propio en lugar de la dirección `*.cloudfront.net`.
