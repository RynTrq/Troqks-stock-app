import Link from "next/link";
import Image from "next/image";

const Layout = ({children} : {children : React.ReactNode}) => {
    return (
        <main className = "auth-layout">
            <section className="auth-left-section scrollbar-hide-default">
                <Link href="/" className="auth-logo">
                    <Image src="/assets/icons/ExtendedLogo.png" alt="Troqks logo" width={140} height={32} className="h-8 w-auto cursor-pointer transition-transform duration-300 hover:scale-105" />
                </Link>

                <div className="pb-6 lg:pb-8 flex-1">
                    {children}
                </div>
            </section>

            <section className="auth-right-section">
                <div className="z-10 relative lg:mt-4 lg:mb-16">
                    <div className="auth-blockquote">
                        Research live symbols, build strategy experiments, and keep a clean ledger of only the work you actually run.
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <span className="rounded-md border border-gray-700 px-3 py-2">Live market workspace</span>
                        <span className="rounded-md border border-gray-700 px-3 py-2">User-owned research log</span>
                        <span className="rounded-md border border-gray-700 px-3 py-2">No fabricated performance data</span>
                    </div>
                </div>

                <div className="flex-1 relative">
                    <Image src="/assets/images/dashboard-preview.jpeg" alt="Dashboard Preview" width={1440} height={1150} className="auth-dashboard-preview absolute top-0"/>
                </div>
            </section>
        </main>
    )
}
export default Layout
