# Hard requirement: the user must not be able to get surprised by a bill.
# Two notifications on the same USD 1 monthly budget -- an early warning
# before the month is even over (FORECASTED), and a same-day heads-up once
# actual spend crosses the line (ACTUAL) -- rather than a single threshold,
# so there is a chance to react before the month closes.
resource "aws_budgets_budget" "monthly_cap" {
  name         = "${local.name_prefix}-monthly-cap"
  budget_type  = "COST"
  limit_amount = var.budget_limit_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
