/**
 * This module implements a REST-inspired web service for the Monopoly DB hosted
 * on PostgreSQL for Azure. Notes:
 *
 * - Currently, this service supports the Player table only.
 *
 * - This service is written in TypeScript and uses Node type-stripping, which
 * is experimental, but simple (see: https://nodejs.org/en/learn/typescript/run-natively).
 * To do a static type check, run the following:
 *      npm run type-check
 *
 * - The service assumes that the database connection strings and the server
 * mode are set in environment variables (e.g., using a git-ignored `.env.sh` file).
 * See the DB_* variables used by pgPromise.
 *
 * - To execute locally, run the following:
 *      source .env.sh
 *      npm start
 *
 * - To guard against SQL injection attacks, this code uses pgPromise's built-in
 * variable escaping. This prevents a client from issuing this SQL-injection URL:
 *     `https://cs262.azurewebsites.net/players/1;DELETE FROM Player`
 * which would delete records in the PlayerGame and then the Player tables.
 * In particular, we don't use JS template strings because this doesn't filter
 * client-supplied values properly.
 *
 * - The endpoints call `next(err)` to handle errors without crashing the service.
 * This initiates the default error handling middleware, which logs full error
 * details to the server-side console and returns uninformative HTTP 500
 * responses to clients. This makes the service a bit more secure (because it
 * doesn't reveal database details to clients), but also makes it more difficult
 * for API users (because they don't get useful error messages).
 *
 * @author: kvlinden
 * @date: Summer, 2020
 * @date: Fall, 2025 (updated to JS->TS, Node version, and master->main repo)
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pgPromise from 'pg-promise';

// Load environment variables from .env file
dotenv.config();

// Import types for compile-time checking.
import type { Request, Response, NextFunction } from 'express';
import type { Player, PlayerInput, MonopolyGame } from './player.js';

// Set up the database
const db = pgPromise()({
    host: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT as string) || 5432,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Configure the server and its routes
const app = express();
const port: number = parseInt(process.env.PORT as string) || 3000;
const router = express.Router();

// Configure CORS to allow cross-origin requests
app.use(cors({
    origin: [
        'http://localhost:3000', 
        'http://localhost:3001', 
        'http://localhost:8081',  // Expo default port
        'exp://localhost:19000',  // Expo development URLs
        'http://localhost:19006', // Expo web port
        'https://cs262lab09-bqekb7ezfnhxctc7.canadacentral-01.azurewebsites.net'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

router.use(express.json());
router.get('/', readHello);
router.get('/players', readPlayers);
router.get('/players/:id', readPlayer);
router.put('/players/:id', updatePlayer);
router.post('/players', createPlayer);
router.delete('/players/:id', deletePlayer);

// Homework 3 Endpoints
router.get('/games', readGames);
router.get('/games/:id', readGame);
router.delete('/games/:id', deleteGame);



// Project routes (ignore for Lab/HW) //
// Default Domain: cs262lab09-bqekb7ezfnhxctc7.canadacentral-01.azurewebsites.net

/* Homepage Routes */
router.get('/adventures', readAdventures);
router.get('/adventuresInRegion/:id', readAdventuresByRegion);

/*  Profile Routes  */
router.get('/adventurer/:id', readAdventurer);
router.get('/AdventuresCompleted/:id', readAdventuresCompletedByAdventurer)

/* Create Adventure Routes */
router.get('regions', readRegions);
router.get('landmarks/:id', readLandmarksInRegion)

/* Playing Adventure Routes */
// Use landmarks/:id route to get landmarks in region
router.get('tokens/:id', readTokensInAdventure)


app.use(router);

app.listen(port, (): void => {
    console.log(`Listening on port ${port}`);
});

/**
 * This utility function standardizes the response pattern for database queries,
 * returning the data using the given response, or a 404 status for null data
 * (e.g., when a record is not found).
 */
function returnDataOr404(response: Response, data: unknown): void {
    if (data == null) {
        response.sendStatus(404);
    } else {
        response.send(data);
    }
}

/* 
PROJECT ROUTES
*/
// Get all adventures
function readAdventures(request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone('SELECT * FROM Adventure')
        .then((data: any[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

// Get all adventures in region 
function readAdventuresByRegion(request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone(
        'SELECT * FROM Adventure WHERE regionID=${id}'
        , request.params)
        .then((data: any[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/*  Profile Page  */
function readAdventurer(request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone(
        'SELECT * FROM Adventurer WHERE ID=${id}'
        , request.params)
        .then((data: any[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}
function readAdventuresCompletedByAdventurer(request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone(
        'SELECT * FROM CompletedAdventure WHERE adventurerID=${id}'
        , request.params)
        .then((data: any[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/* Create Adventure */
function readRegions(request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone('SELECT * FROM Region')
        .then((data: any[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

function readLandmarksInRegion(request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone(
        'SELECT * FROM Landmark WHERE regionID=${id}'
        , request.params)
        .then((data: any[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/* Play Adventure */
function readTokensInAdventure(request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone('SELECT * FROM Token WHERE adventureID=${id}'
        , request.params)
        .then((data: any[]): void => {
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}



// LAB/HW ROUTERS //
/**
 * This endpoint returns a simple hello-world message, serving as a basic
 * health check and welcome message for the API.
 */
function readHello(_request: Request, response: Response): void {
    response.send('Hello, CS 262 Monopoly service!');
}

// CRUD functions

/**
 * Retrieves all players from the database.
 */
function readPlayers(_request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone('SELECT * FROM Player')
        .then((data: Player[]): void => {
            // data is a list, never null, so returnDataOr404 isn't needed.
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * Retrieves a specific player by ID.
 */
function readPlayer(request: Request, response: Response, next: NextFunction): void {
    db.oneOrNone('SELECT * FROM Player WHERE id=${id}', request.params)
        .then((data: Player | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * This function updates an existing player's information, returning the
 * updated player's ID if successful, or a 404 status if the player doesn't
 * exist.
 */
function updatePlayer(request: Request, response: Response, next: NextFunction): void {
    db.oneOrNone('UPDATE Player SET email=${body.email}, name=${body.name} WHERE id=${params.id} RETURNING id', {
        params: request.params,
        body: request.body as PlayerInput
    })
        .then((data: { id: number } | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * This function creates a new player in the database based on the provided
 * email and name, returning the newly created player's ID. The database is
 * assumed to automatically assign a unique ID using auto-increment.
 */
function createPlayer(request: Request, response: Response, next: NextFunction): void {
    db.one('INSERT INTO Player(email, name) VALUES (${email}, ${name}) RETURNING id',
        request.body as PlayerInput
    )
        .then((data: { id: number }): void => {
            // New players are always created, so returnDataOr404 isn't needed.
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

/**
 * This function deletes an existing player based on ID.
 *
 * Deleting a player requires cascading deletion of PlayerGame records first to
 * maintain referential integrity. This function uses a transaction (`tx()`) to
 * ensure that both the PlayerGame records and the Player record are deleted
 * atomically (i.e., either both operations succeed or both fail together).
 *
 * This function performs a "hard" delete that actually removes records from the
 * database. Production systems generally to use "soft" deletes in which records
 * are marked as archived/deleted rather than actually deleting them. This helps
 * support data recovery and audit trails.
 */
function deletePlayer(request: Request, response: Response, next: NextFunction): void {
    db.tx((t) => {
        return t.none('DELETE FROM PlayerGame WHERE playerID=${id}', request.params)
            .then(() => {
                return t.oneOrNone('DELETE FROM Player WHERE id=${id} RETURNING id', request.params);
            });
    })
        .then((data: { id: number } | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}




// Homework 3 Functions
function readGames(_request: Request, response: Response, next: NextFunction): void {
    db.manyOrNone('SELECT * FROM Game')
        .then((data: MonopolyGame[]): void => {
            // data is a list, never null, so returnDataOr404 isn't needed.
            response.send(data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

function readGame(request: Request, response: Response, next: NextFunction): void {
    db.oneOrNone('SELECT * FROM Game WHERE id=${id}', request.params)
        .then((data: Player | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}

function deleteGame(request: Request, response: Response, next: NextFunction): void {
    db.tx((t) => {
        return t.none('DELETE FROM PlayerGame WHERE gameID=${id}', request.params)
            .then(() => {
                return t.oneOrNone('DELETE FROM Game WHERE id=${id} RETURNING id', request.params);
            });
    })
        .then((data: { id: number } | null): void => {
            returnDataOr404(response, data);
        })
        .catch((error: Error): void => {
            next(error);
        });
}