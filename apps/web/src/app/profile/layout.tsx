import { ProfileHeader } from "@/components/profile-header";
import { Streak } from "@/components/streak";

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="mx-auto max-w-4xl">
            <ProfileHeader />
            <Streak />
            {children}
        </div>
    );
}
