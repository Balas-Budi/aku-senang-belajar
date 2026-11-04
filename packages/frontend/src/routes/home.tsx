import { redirect } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import { roleHome } from '../features/auth/queries';
import type { Route } from './+types/home';
export async function loader({ request }: Route.LoaderArgs) {
    const { user } = await requireUser(request);
    throw redirect(roleHome(user.role));
}
export default function Home() {
    return null;
}
