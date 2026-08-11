BEGIN;

SET LOCAL lock_timeout = '10s';

LOCK TABLE "MuscleGroup" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "MuscleGroup" AS existing
        INNER JOIN (
            VALUES
                ('chest', 'Pecho'),
                ('back', 'Espalda'),
                ('shoulders', 'Hombros'),
                ('biceps', 'Bíceps'),
                ('triceps', 'Tríceps'),
                ('legs', 'Piernas'),
                ('glutes', 'Glúteos'),
                ('abs', 'Abdominales'),
                ('trapezius', 'Trapecio'),
                ('forearm', 'Antebrazo'),
                ('calves', 'Gemelos'),
                ('hamstrings', 'Isquiotibiales'),
                ('quadriceps', 'Cuádriceps'),
                ('deltoids', 'Deltoides')
        ) AS canonical("tag", "name")
            ON existing."name" = canonical."name"
            AND existing."tag" <> canonical."tag"
    ) THEN
        RAISE EXCEPTION 'reference_data_provisioning_incompatible_state'
            USING ERRCODE = 'P0001';
    END IF;
END $$;

MERGE INTO "MuscleGroup" AS target
USING (
    VALUES
        ('chest', 'Pecho'),
        ('back', 'Espalda'),
        ('shoulders', 'Hombros'),
        ('biceps', 'Bíceps'),
        ('triceps', 'Tríceps'),
        ('legs', 'Piernas'),
        ('glutes', 'Glúteos'),
        ('abs', 'Abdominales'),
        ('trapezius', 'Trapecio'),
        ('forearm', 'Antebrazo'),
        ('calves', 'Gemelos'),
        ('hamstrings', 'Isquiotibiales'),
        ('quadriceps', 'Cuádriceps'),
        ('deltoids', 'Deltoides')
) AS source("tag", "name")
    ON target."tag" = source."tag"
WHEN MATCHED AND target."name" IS DISTINCT FROM source."name" THEN
    UPDATE SET "name" = source."name"
WHEN NOT MATCHED THEN
    INSERT ("name", "tag") VALUES (source."name", source."tag");

COMMIT;
