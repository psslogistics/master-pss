import ClientKycReview from "@/components/admin/client-kyc-review";

export default function ClientOnboardingRoute() {
  return <div className="space-y-5">
    <header>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Client onboarding</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Onboarding &amp; KYC</h1>
      <p className="mt-1 text-sm text-muted-foreground">Review submitted identity and business documents before approving client access.</p>
    </header>
    <ClientKycReview />
  </div>;
}
