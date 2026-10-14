""" Configuration """


import os


def get_database_url() -> str:
    """ Get database url """
    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError("DATABASE_URL is not configured")

    return url