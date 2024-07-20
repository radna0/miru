import os
import json

# read final_animes_miru.json
# split into 10 files and save to split/data


def split_data():
    with open("final_animes_miru.json") as f:
        data = json.load(f)
    n = len(data)
    print(n)
    # create split folder
    os.makedirs("split", exist_ok=True)
    for i in range(10):
        start = i * n // 10
        end = (i + 1) * n // 10
        with open(f"split/data_{i}.json", "w") as f:
            json.dump(data[start:end], f)


split_data()
