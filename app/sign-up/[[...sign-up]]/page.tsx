import { SignUp } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUp
        appearance={{ theme: shadcn }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
      />
    </div>
  );
}