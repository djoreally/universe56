import LoginForm from "@/components/LoginForm";

// The auth base URL is a public service endpoint (not a credential); the
// browser must know it to POST /sign-in/email directly to Neon Managed Auth.
export default function LoginPage() {
  return <LoginForm authBase={process.env.NEON_AUTH_BASE_URL || ""} />;
}
