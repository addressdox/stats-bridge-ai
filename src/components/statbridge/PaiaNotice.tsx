/** The media enquiry form does not replace the prescribed statutory request form. */
export function PaiaNotice({ compact = false }: { compact?: boolean }) {
  return <section className="rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-muted-foreground" aria-label="PAIA compliance guidance">
    <p className="font-semibold text-foreground">PAIA — access to information</p>
    <p className="mt-1">This process supports access to published information under the Promotion of Access to Information Act, 2000 (PAIA), with official review and protection of confidential information.</p>
    {!compact && <p className="mt-1">For a formal request for records, follow the prescribed procedure in Stats SA's PAIA manual and submit it to the Information Officer. This media enquiry does not replace that statutory application or determine access rights.</p>}
    <a href="https://www.statssa.gov.za/wp-content/uploads/2022/09/Stats-SA-PAIA-manual-2022.pdf" target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-accent underline underline-offset-2">Stats SA PAIA manual and request procedure</a>
  </section>;
}
