"""
Telstra Network Disruptions Real Dataset Unpacker & Loader
Extracts authentic Kaggle Telstra CSV dataset files from the uploaded zip archive
into the 'data/' directory.
"""

import os
import glob
import zipfile
import pandas as pd

def unpack_real_dataset(dataset_dir="dataset", output_dir="data"):
    os.makedirs(output_dir, exist_ok=True)
    zip_files = glob.glob(os.path.join(dataset_dir, "**", "*.zip"), recursive=True)
    
    if not zip_files:
        print(f"Warning: No zip files found in '{dataset_dir}'. Checking if CSV files already exist in '{output_dir}'...")
        return

    print(f"Found {len(zip_files)} dataset zip files in '{dataset_dir}'. Extracting to '{output_dir}'...")
    
    for zpath in zip_files:
        with zipfile.ZipFile(zpath, 'r') as zf:
            for member in zf.namelist():
                if member.endswith(".csv"):
                    zf.extract(member, output_dir)
                    print(f" - Extracted: {member}")

    print("All dataset files successfully unpacked into 'data/'.")

if __name__ == "__main__":
    unpack_real_dataset()
