import {NextResponse} from "next/server";

export const jsonError = (message: string, status = 400) =>
    NextResponse.json({error: message}, {status});

export const getRequestBody = async <T>(request: Request): Promise<T | null> => {
    try {
        return (await request.json()) as T;
    } catch {
        return null;
    }
};
