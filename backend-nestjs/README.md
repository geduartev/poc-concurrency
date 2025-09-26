# Backend NestJS

Servicio de ejemplo para validar la regla de incentivos de Confiados.

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run start:dev
```

El servicio escucha por defecto en `http://localhost:3000` y expone el endpoint `PATCH /account-notebook/:id/status`.

## Migraciones

```bash
npm run build
npm run migration:run
```

Las entidades replican las tablas requeridas y las migraciones se encuentran en `migrations/`.
