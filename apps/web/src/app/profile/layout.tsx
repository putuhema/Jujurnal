import { ProfileHeader } from "@/components/profile-header";
import { Streak } from "@/components/streak";

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div>
            <Streak />
            <ProfileHeader />
            {children}
        </div>
    );
}
