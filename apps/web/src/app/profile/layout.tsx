import { ProfileHeader } from "@/components/profile-header";
import { ProfileTabs } from "@/components/profile-tabs";

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="mx-auto max-w-4xl">
            <ProfileHeader />
            <ProfileTabs />
            {children}
        </div>
    );
}
