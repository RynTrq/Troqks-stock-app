import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {SESSION_COOKIE_NAME, verifySessionToken} from "@/lib/session";

export const GET = async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
        return NextResponse.json({user: null}, {status: 401});
    }

    return NextResponse.json({user});
};
