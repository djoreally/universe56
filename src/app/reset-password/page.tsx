import ResetPasswordForm from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const authBase = (process.env.NEON_AUTH_BASE_URL || "").replace(/\/$/, "");
  const { token } = await searchParams;
  return <ResetPasswordForm authBase={authBase} token={token || ""} />;
}
