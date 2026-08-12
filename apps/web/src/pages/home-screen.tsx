import { useClusters } from "@/hooks/use-clusters";

export const HomeScreen = () => {
    const { data, loading, error } = useClusters();

    if (loading) {
        return <div>Loading clusters...</div>;
    }

    if (error) {
        return <div>Failed to load clusters: {error.message}</div>;
    }

    return (
        <div>
            <h1>Cluster Map</h1>

            <h2>Available clusters</h2>

            <ul>
                {data?.clusters.map((cluster) => (
                    <li key={cluster.id}>
                        {cluster.label} (#{cluster.number})
                    </li>
                ))}
            </ul>
        </div>
    );
};

