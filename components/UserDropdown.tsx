'use client'

import {useEffect, useState} from "react";
import { Button } from "@/components/ui/button"
import {LogOut} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {useRouter} from "next/navigation";
import NavItems from "@/components/NavItems";

const UserDropdown = () => {
    const router = useRouter();
    const [user, setUser] = useState<SessionUser | null>(null);

    useEffect(() => {
        let ignore = false;

        const loadUser = async () => {
            const response = await fetch('/api/auth/me');

            if (ignore) return;

            if (!response.ok) {
                setUser(null);
                return;
            }

            const result = await response.json() as {user: SessionUser};
            setUser(result.user);
        };

        void loadUser();

        return () => {
            ignore = true;
        };
    }, []);

    const handleSignOut = async () => {
        await fetch('/api/auth/sign-out', {method: 'POST'});
        setUser(null);
        router.refresh();
        router.push("/sign-in");
    }

    const displayUser = user ?? {name: "Guest", email: "Sign in to personalize Troqks"};

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-3 text-gray-4 hover:text-yellow-500">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-yellow-500 text-yellow-900 text-sm font-bold">
                            {displayUser.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start">
                        <span className="text-base font-medium text-gray-400">
                            {displayUser.name}
                        </span>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>
                    <div className="flex relative items-center gap-3 py-2">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-yellow-500 text-yellow-900 text-sm font-bold">
                                {displayUser.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-base font-medium text-gray-400">
                                {displayUser.name}
                            </span>
                            <span className="text-sm text-gray-500">
                                {displayUser.email}
                            </span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-600" />
                <nav className="sm:hidden">
                    <NavItems />
                </nav>
                <DropdownMenuSeparator className="sm:hidden bg-gray-600" />
                <DropdownMenuItem onClick={handleSignOut} className="text-gray-100 text-md font font-medium focus:bg-transparent focus:text-yellow-500 transition-colors cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2 hidden sm:block" />
                    Logout
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
export default UserDropdown
