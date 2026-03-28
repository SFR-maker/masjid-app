import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-800">Masjidly Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Create your account</p>
        </div>
        <SignUp />
      </div>
    </div>
  )
}
