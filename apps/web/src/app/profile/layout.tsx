import { ProfileHeader } from "@/components/profile-header";
import { ProfileTabs } from "@/components/profile-tabs";
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
            <ProfileTabs />
            {children}
        </div>
    );
}
