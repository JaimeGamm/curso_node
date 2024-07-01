import mysql from "mysql2/promise";
import { preprocess, z } from "zod";

const DEFAULT_CONFING = {
  host: "localhost",
  user: "root",
  port: 3306,
  password: "",
  database: "moviesdb",
};

const connectionString = process.env.DATABASE_URL
  ? JSON.parse(process.env.DATABASE_URL)
  : DEFAULT_CONFING;

const connection = await mysql.createConnection(connectionString);

export class MovieModel {
  static async getAll({ genre }) {
    console.log("getAll");

    if (genre) {
      const lowerCaseGenre = genre.toLowerCase();

      try {
        // Obtener los IDs de género de la tabla de la base de datos usando los nombres de género
        const [genres] = await connection.query(
          "SELECT id FROM genre WHERE LOWER(name) = ?;",
          [lowerCaseGenre]
        );

        // Si no se encuentra ningún género, devolver un arreglo vacío
        if (genres.length === 0) return [];

        // Obtener el ID del primer resultado de género
        const [{ id }] = genres;

        // Consulta para obtener todas las películas asociadas al género dado
        const [movies] = await connection.query(
          `
              SELECT 
                m.title, m.year, m.director, m.duration, m.poster, m.rate, BIN_TO_UUID(m.id) as id
              FROM 
                movie m
              INNER JOIN 
                movie_genres mg ON m.id = mg.movie_id
              INNER JOIN 
                genre g ON mg.genre_id = g.id
              WHERE 
                g.id = ?;
            `,
          [id]
        );

        // Devolver el resultado de las películas encontradas para ese género
        return movies;
      } catch (error) {
        console.error("Error fetching movies by genre:", error);
        return []; // Manejar el error adecuadamente según tu aplicación
      }
    } else {
      const [movies] = await connection.query(
        "SELECT title, year, director, duration, poster, rate, BIN_TO_UUID(id) id FROM movie;"
      );
      return movies; // Otra acción o valor predeterminado según tu lógica de negocio
    }
  }
  static async getById({ id }) {
    const [movies] = await connection.query(
      `SELECT title, year, director, duration, poster, rate, BIN_TO_UUID(id) id
        FROM movie WHERE id = UUID_TO_BIN(?);`,
      [id]
    );

    if (movies.length === 0) return null;

    return movies[0];
  }

  static async create({ input }) {
    const {
      genre: genreInput, // genre is an array
      title,
      year,
      duration,
      director,
      rate,
      poster,
    } = input;

    // todo: crear la conexión de genre

    // crypto.randomUUID()
    const [uuidResult] = await connection.query("SELECT UUID() uuid;");
    const [{ uuid }] = uuidResult;

    try {
      await connection.query(
        `INSERT INTO movie (id, title, year, director, duration, poster, rate)
          VALUES (UUID_TO_BIN("${uuid}"), ?, ?, ?, ?, ?, ?);`,
        [title, year, director, duration, poster, rate]
      );
    } catch (e) {
      // puede enviarle información sensible
      throw new Error("Error creating movie");
      // enviar la traza a un servicio interno
      // sendLog(e)
    }

    const [movies] = await connection.query(
      `SELECT title, year, director, duration, poster, rate, BIN_TO_UUID(id) id
        FROM movie WHERE id = UUID_TO_BIN(?);`,
      [uuid]
    );

    return movies[0];
  }

  static async delete({ id }) {
    try {
      const [movie] = await connection.query(
        "DELETE FROM movie WHERE id = UUID_TO_BIN(?);",
        [id]
      );

      if (movie.affectedRows > 0) {
        await connection.query(
          "DELETE FROM movie_genres WHERE movie_id = UUID_TO_BIN(?);",
          [id]
        );
        console.log(movie[0]);
        return { message: "Movie successfully deleted." };
      } else {
        return { message: "No movie found with the given ID.", movie };
      }
    } catch (error) {
      throw new Error(`Error deleting movie: ${error.message}`);
    }
  }

  static async update({ id, input }) {
    try {
      const {
        genre: genreInput,
        title,
        year,
        duration,
        director,
        rate,
        poster,
      } = input;

      const [movie] = await connection.query(
        "SELECT BIN_TO_UUID(id) id, title, year, director, duration, poster, rate FROM movie WHERE BIN_TO_UUID(id) = ?;",
        [id]
      );

      if (movie.length === 0) return false;

      const updateColumns = Object.entries({
        title,
        year,
        duration,
        director,
        rate,
        poster,
      })
        .filter(([key, value]) => value !== undefined)
        .map(([key, value]) => `${key} = ?`)
        .join(", ");

      const updateValues = Object.values({
        title,
        year,
        duration,
        director,
        rate,
        poster,
      }).filter((value) => value !== undefined);

      await connection.query(
        `UPDATE movie SET ${updateColumns} WHERE id = UUID_TO_BIN(?);`,
        [...updateValues, id]
      );

      // Actualizar la tabla de géneros
      if (genreInput) {
        await connection.query(
          "DELETE FROM movie_genres WHERE movie_id = UUID_TO_BIN(?);",
          [id]
        );

        const genreNames = genreInput.split(",");

        for (const genreName of genreNames) {
          const [result] = await connection.query(
            "SELECT id FROM genre WHERE name = ?;",
            [genreName.trim()]
          );

          if (result.length > 0) {
            await connection.query(
              "INSERT INTO movie_genres (movie_id, genre_id) VALUES (UUID_TO_BIN(?), ?);",
              [id, result[0].id]
            );
          }
        }
      }

      return this.getById({ id });
    } catch (error) {
      throw new Error(`Error updating movie: ${error.message}`);
    }
  }
}
