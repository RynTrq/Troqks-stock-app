import Link from 'next/link'
import Image from 'next/image'
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";

const Header = () => {

    return (
        <header className= "sticky top-0 header">
            <div className= "container header-wrapper">
                <Link href = "/">
                    <Image src= "/assets/icons/ExtendedLogo.png" alt = "Troqks Logo" width={140} height={32} className = "px-4 scale-210 h-8 w-auto cursor-pointer cursor-pointer transition-transform duration-300 hover:scale-150"></Image>
                </Link>
                <nav className= "hidden sm:block">
                    <NavItems />
                </nav>
                <UserDropdown />
            </div>
        </header>
    )
}
export default Header
