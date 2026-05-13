/**
 * Kill switch for the Welcome Report feature.
 *
 * Default is ON. Set `VITALS_WELCOME_REPORT_ENABLED=false` to disable.
 * The Welcome Report is wired in a parallel phase — this helper will be
 * imported there to short-circuit generation/rendering when needed.
 */
export function isWelcomeReportEnabled(): boolean {
  return process.env.VITALS_WELCOME_REPORT_ENABLED !== "false";
}
