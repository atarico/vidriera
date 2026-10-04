# Costo mensual de operación

Para un comercio chico, Vidriera cuesta **entre USD 0 y 1 por mes, más el dominio**.
Todos los servicios entran en su plan gratuito. El único límite a vigilar son las
**10.000 búsquedas por mes de Algolia**.

> **Fecha de verificación: 2026-10-04.** Los precios se contrastaron con las páginas
> oficiales listadas en [Fuentes](#fuentes). Los precios cambian: volver a
> verificarlos antes de tomar una decisión. Lo que no pudo confirmarse figura en
> [Sin verificar](#sin-verificar).

## Pasos rápidos

1. Crear la cuenta de AWS con el **plan Paid**. En el plan Free (cuentas creadas desde
   el 2025-07-15), la cuenta se suspende a los 6 meses o cuando se agotan los
   créditos, lo que ocurra primero, y hay 90 días para pasar a Paid y recuperarla. En
   el plan Paid, los créditos se pueden usar hasta 12 meses. Los servicios
   "siempre gratis" aplican en ambos planes.
2. Usar los planes gratuitos de Sanity, Algolia y Cloudinary.
3. Agregar debounce a la búsqueda de la tienda antes del lanzamiento (ver
   [Riesgo principal](#riesgo-principal-las-búsquedas-de-algolia)).
4. Revisar el gasto real una vez por mes con los comandos de la sección "Checking
   costs" del [runbook](runbook.md#checking-costs).

## Estimación

Escenario de referencia (**supuesto**): 300 productos, 2 imágenes por producto,
~1.000 visitas por mes.

| Servicio | Límite del plan gratuito | Uso estimado | Costo mensual | Fuente |
|---|---|---|---|---|
| Sanity | 10K documentos, 1M de requests a la API CDN por mes, 2 webhooks, 2 datasets (solo públicos) | ~300 documentos, 1 webhook | USD 0 | [Sanity](https://www.sanity.io/pricing) |
| Algolia | 50K registros, **10K búsquedas por mes** | 5K a 10K búsquedas | USD 0 (cerca del tope) | [Algolia](https://www.algolia.com/pricing) |
| Cloudinary | 25 créditos por mes (1 crédito = 1 GB almacenado, 1 GB entregado o 1K transformaciones) | ~1 GB almacenado + 1 a 3 GB entregados | USD 0 | [Cloudinary](https://cloudinary.com/pricing) |
| Lambda | 1M de requests por mes, siempre gratis | Unos cientos de requests | USD 0 | [Lambda](https://aws.amazon.com/lambda/pricing/) |
| SQS | 1M de requests por mes, siempre gratis | Unos cientos de requests | USD 0 | [SQS](https://aws.amazon.com/sqs/pricing/) |
| SNS | 1M de requests por mes y 1.000 emails por mes gratis | Unos pocos avisos | USD 0 | [SNS](https://aws.amazon.com/sns/pricing/) |
| CloudFront | 1 TB de transferencia y 10M de requests por mes, siempre gratis | Unos pocos GB | USD 0 | [CloudFront](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/) |
| S3 | Sin capa gratuita permanente; USD 0,023 por GB-mes | ~50 MB de sitio | ~USD 0,001 | [S3](https://aws.amazon.com/s3/pricing/) |
| ECR | 500 MB gratis solo el primer año; después USD 0,10 por GB-mes | Imagen de ~300 MB | USD 0, luego ~USD 0,03 | [ECR](https://aws.amazon.com/ecr/pricing/) |
| Fargate (reindexado) | Sin capa gratuita; ~USD 0,0123 por hora | Unos minutos por ejecución | Centavos | [Fargate](https://aws.amazon.com/fargate/pricing/) |
| Budgets, SSM, CloudWatch Logs | Uso dentro de lo gratuito (**sin verificar**) | Mínimo | USD 0 | [Budgets](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/), [SSM](https://aws.amazon.com/systems-manager/pricing/), [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/) |
| Dominio `.com.ar` | Registro y renovación: ARS 8.500 por año | 1 dominio | ~ARS 708 por mes | [NIC Argentina](https://nic.ar/es/dominios/dominios_y_aranceles) |
| Route 53 (solo si se usa para el DNS) | USD 0,50 por zona hospedada por mes | 1 zona | USD 0,50 | [Route 53](https://aws.amazon.com/route53/pricing/) |

## Tres escenarios

Supuestos comunes (todos son **supuesto**, no mediciones):

- Cada visita genera entre **5 y 10 búsquedas** en Algolia, porque hoy la búsqueda no
  tiene debounce (cada tecla es una búsqueda).
- Con debounce, **2 a 3 búsquedas por visita** (supuesto: no está medido).
- Catálogo de 300 productos y 600 imágenes: ~1 GB almacenado y 4 renditions por
  imagen, es decir ~2.400 transformaciones (~2,4 créditos, una sola vez porque
  Cloudinary las guarda). Entrega de imágenes: 1 a 3 MB por visita (supuesto,
  derivado del uso de referencia de 1 a 3 GB por 1.000 visitas).
- CloudFront sirve solo el sitio estático: ~0,5 MB y ~10 requests por visita
  (supuesto). Las imágenes salen de Cloudinary.
- Plan **Algolia Grow** cuando se supera el tope: USD 0 de base, 10K búsquedas
  incluidas y **USD 0,50 por cada 1K búsquedas** adicionales.

### Sin debounce (situación actual)

| | Chica (~1.000 visitas) | Mediana (~3.000 visitas) | Alto tráfico (~10.000 visitas) |
|---|---|---|---|
| Búsquedas en Algolia (5 a 10 por visita) | 5K a 10K | 15K a 30K | 50K a 100K |
| Excedente sobre 10K | 0 | 5K a 20K | 40K a 90K |
| Costo en Algolia Grow | USD 0 | 5 × 0,50 = USD 2,50 a 20 × 0,50 = USD 10 | 40 × 0,50 = USD 20 a 90 × 0,50 = USD 45 |
| Créditos de Cloudinary (1 + 2,4 + entrega) | ~4,4 a 6,4 de 25 | ~6,4 a 12,4 de 25 | ~13,4 a 33,4 de 25 (**el máximo supera el límite**) |
| CloudFront (transferencia y requests) | ~0,5 GB, ~10K requests | ~1,5 GB, ~30K requests | ~5 GB, ~100K requests (de 1 TB y 10M gratis) |
| **Total mensual estimado** | **USD 0 a 1** | **USD 2,50 a 11** | **USD 20 a 46** |

Los totales suman USD 0 a 1 de infraestructura (S3, ECR, Fargate) al costo de
Algolia. En el plan Free, sin pasar a Grow, no se cobra excedente, pero Algolia puede
suspender la búsqueda (ver [Riesgo principal](#riesgo-principal-las-búsquedas-de-algolia)).

### Con debounce (supuesto: 2 a 3 búsquedas por visita)

| | Chica (~1.000 visitas) | Mediana (~3.000 visitas) | Alto tráfico (~10.000 visitas) |
|---|---|---|---|
| Búsquedas en Algolia | 2K a 3K | 6K a 9K | 20K a 30K |
| Excedente sobre 10K | 0 | 0 | 10K a 20K |
| Costo en Algolia Grow | USD 0 | USD 0 | 10 × 0,50 = USD 5 a 20 × 0,50 = USD 10 |
| **Total mensual estimado** | **USD 0 a 1** | **USD 0 a 1** | **USD 5 a 11** |

El resto de los componentes (Cloudinary, CloudFront) no cambia con el debounce. Con
debounce, el escenario Mediana cabe en el plan gratuito de Algolia.

## Riesgo principal: las búsquedas de Algolia

- La búsqueda de la tienda no tiene debounce: cada tecla dispara una búsqueda. Con los
  filtros y la carga inicial, son unas 5 a 10 búsquedas por visita (supuesto).
- Con ~1.000 visitas por mes se está cerca del tope de 10K. Con ~3.000 visitas se
  supera.
- El plan Free **no cobra excedente**. Si se superan los límites, Algolia puede
  **suspender el servicio de búsqueda** o **agregar su atribución** a los resultados,
  hasta que se elija un plan de pago. La atribución no se exige de entrada: solo
  aparece como consecuencia de exceder los límites.
- Para seguir funcionando pasado el tope, el plan **Grow** (pago por uso, USD 0 de
  base, sin contrato) incluye 10K búsquedas y 100K registros, y cobra USD 0,50 por
  1K búsquedas adicionales y USD 0,40 por 1K registros adicionales. Ejemplo: 30K
  búsquedas por mes equivalen a USD 10.
- Mitigación: agregar debounce al campo de búsqueda. Está fuera del alcance de este
  documento (es un cambio de código).

## Otros datos

| Tema | Detalle |
|---|---|
| Datasets de Sanity | En el plan Free los datasets son **solo públicos**: cualquier borrador o campo interno puede leerse sin token. |
| Renditions de Cloudinary | Cada imagen genera 4 renditions (card, hero, og, lqip), es decir 4 transformaciones. 600 imágenes son ~2.400 transformaciones, muy por debajo del límite. |
| Primeros planes de pago | Sanity Growth: USD 15 por usuario por mes. Cloudinary Plus: USD 99 por mes (USD 89 con facturación anual). No hacen falta a esta escala. |
| Planes de tarifa fija de CloudFront | Free: USD 0, 1M de requests, 100 GB. Pro: USD 15, 10M de requests, 50 TB. El pago por uso ya incluye 1 TB gratis, así que es la mejor opción acá. |
| Fargate | La tarea de reindexado usa 0,25 vCPU + 0,5 GB (x86): 0,25 × 0,04048 + 0,5 × 0,004445 ≈ USD 0,0123 por hora. Una ejecución de 10 minutos cuesta ~USD 0,002. |
| Mayor gasto accidental | Dejar prendido el servicio ECS de reindexado: 0,0123 × 730 horas ≈ USD 9 por mes. |
| Comentario incorrecto en el repo | `infra/terraform/storefront.tf:75` dice que la capa gratuita de CloudFront dura 12 meses. Es siempre gratis. Falta corregir el comentario (no se modificó en esta tarea). |
| Protecciones de costo ya activas | Sin NAT Gateway, SSM en nivel estándar, `desired_count = 0` en el servicio de reindexado, retención corta de logs y alarma de presupuesto en USD 1. Ver [`architecture.md`](architecture.md). |

## Sin verificar

- Precios exactos de Budgets, SSM nivel estándar y CloudWatch Logs (el uso queda
  dentro de lo gratuito).
- Redacción exacta del monto gratuito de Lambda (1M de requests por mes; se lo trata
  como parcialmente confirmado).
- Precio de Cloudinary Plus (parcialmente confirmado).
- Qué ocurre en Cloudinary Free al superar los 25 créditos por mes (relevante solo
  en el escenario de alto tráfico).
- La página de NIC.ar no muestra fecha de vigencia de los aranceles. El enlace a la
  Resolución 5/2024 del Boletín Oficial está vigente desde 2024-01-15 y no se
  encontró ningún cambio en 2025, pero los precios en pesos cambian seguido: volver
  a verificar antes de registrar.

## Fuentes

Todas consultadas el 2026-10-04. Las cifras de AWS salen de las listas de precios
oficiales (`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/<ServiceCode>/current/index.json`).

| Servicio | URL |
|---|---|
| Sanity | https://www.sanity.io/pricing |
| Algolia (planes y precios) | https://www.algolia.com/pricing |
| Algolia (condiciones del plan Free) | https://www.algolia.com/policies/free-plan-details |
| Cloudinary | https://cloudinary.com/pricing |
| Cloudinary (créditos) | https://cloudinary.com/documentation/developer_onboarding_faq_credits |
| AWS Free Tier (preguntas frecuentes) | https://aws.amazon.com/free/free-tier-faqs/ |
| AWS Free Tier (anuncio de créditos) | https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/ |
| Lambda | https://aws.amazon.com/lambda/pricing/ |
| SQS | https://aws.amazon.com/sqs/pricing/ |
| SNS | https://aws.amazon.com/sns/pricing/ |
| CloudFront (planes) | https://aws.amazon.com/cloudfront/pricing/ |
| CloudFront (pago por uso) | https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ |
| S3 | https://aws.amazon.com/s3/pricing/ |
| Fargate | https://aws.amazon.com/fargate/pricing/ |
| ECR | https://aws.amazon.com/ecr/pricing/ |
| CloudWatch | https://aws.amazon.com/cloudwatch/pricing/ |
| Budgets | https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/ |
| SSM | https://aws.amazon.com/systems-manager/pricing/ |
| Route 53 | https://aws.amazon.com/route53/pricing/ |
| NIC Argentina | https://nic.ar/es/dominios/dominios_y_aranceles |

## Ver también

- [`runbook.md`](runbook.md#checking-costs): cómo revisar el gasto real.
- [`architecture.md`](architecture.md): por qué la arquitectura mantiene el costo bajo.
