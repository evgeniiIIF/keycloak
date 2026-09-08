export declare function getTokenViaPasswordGrant(username: string, password: string): Promise<{
    access_token: string;
    refresh_token: string;
    id_token: string;
}>;
